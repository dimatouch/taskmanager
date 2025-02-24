@@ .. @@
   return (
     <div className="space-y-4">
       {tasks.map(task => (
         <div
           key={task.id}
-          onClick={() => navigate(`/tasks/${task.id}`)}
          onClick={() => navigate(`/${currentCompany?.id}/tasks/${task.id}`)}
+          onClick={() => {
+            const { data: { user } } = await supabase.auth.getUser();
+            if (user) {
+              const { data: profile } = await supabase
+                .from('user_profiles')
+                .select('current_company_id')
+                .eq('user_id', user.id)
+                .single();
+              
+              if (profile?.current_company_id) {
+                navigate(`/${profile.current_company_id}/tasks/${task.id}`);
+              }
+            }
+          }}
           className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-all p-4"
         >
        </div>
      ))}
    </div>
   );